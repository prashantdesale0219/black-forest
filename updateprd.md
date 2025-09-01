# Backend PRD – AI Virtual Try-On & Model Generation Platform (with BFL API Integration)

## 1. Overview
This backend serves as the core for a **Virtual Try-On & Scene Customization platform**.  
Key features:
- Clothing try-on on models (user-uploaded or AI-generated)
- Background/scene modification
- Support multiple domains via **configurable system prompts** (Clothing now, Interior Design later)
- Full integration with **Black Forest Labs (BFL) APIs** for image generation and editing

Built with **Node.js (Express)**, **MongoDB**, using **BFL.ai APIs** for AI tasks.

---

## 2. Objectives
- Modular backend with dynamic domain support
- Secure user authentication & role-based access
- Efficient integration with BFL for all image generation workflows
- Job-based async handling (polling / webhook support)
- Track usage & credits per user

---

## 3. BFL API Integration

### 3.1 Integration Guidelines
- Preferred endpoint: `https://api.bfl.ai/v1/...` (global, auto-failover)  
  :contentReference[oaicite:0]{index=0}  
- For GDPR/compliance, use EU regional endpoint: `api.eu.bfl.ai` (multicluster)  
  :contentReference[oaicite:1]{index=1}  
- Always use `polling_url` returned by generation endpoints to fetch results  
  :contentReference[oaicite:2]{index=2}  

---

### 3.2 Key BFL Endpoints & Usage

#### A. Image Generation (Text-to-Image)
- **FLUX.1 [pro]** — standard generation  
- **FLUX-pro-1.1** — fast, consistent, high-quality (approx. $0.04/image)  
- cURL example:
  ```bash
  curl -X POST "https://api.bfl.ai/v1/flux-pro-1.1" \
   -H "x-key: <API_KEY>" \
   -H "Content-Type: application/json" \
   -d '{
       "prompt": "A model wearing a red dress in studio lighting",
       "width": 1024, "height": 1024, "prompt_upsampling": false,
       "seed": 42, "safety_tolerance": 2, "output_format": "jpeg"
     }'
Response:

json
Copy code
{
  "id": "<string>",
  "polling_url": "<string>"
}
docs.bfl.ai
+1

B. Image Editing (Inpainting/Filled Try-On)
FLUX.1 Fill [pro] — apply clothing or replace parts using image + mask

cURL example:

bash
Copy code
curl -X POST "https://api.bfl.ai/v1/flux-pro-1.0-fill" \
  -H "x-key: <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
      "image": "<model_image_url>",
      "mask": "<mask_url>",
      "prompt": "Place the red T-shirt onto the model with realistic folds",
      "steps": 50, "prompt_upsampling": true, "seed": 123,
      "guidance": 50.75, "output_format": "jpeg", "safety_tolerance": 2
    }'
Response includes id and polling_url
docs.bfl.ai

C. Other Generation Types
Control-based (Canny / Depth):

FLUX.1 Canny [pro] — uses edge control image

FLUX.1 Depth [pro] — uses depth map control
docs.bfl.ai
+1

D. Fetching Results
Endpoint: GET /v1/get_result?id=<taskId>

Response includes:

id, status, result (payload or URL), progress, details, preview
docs.bfl.ai
+1

##### 4. Backend Features & Endpoints
4.1 Auth & Users
POST /auth/register → register

POST /auth/login → login, get JWT

4.2 Model Management
POST /models/upload → custom model image upload

POST /models/generate → text-to-image generation via BFL

GET /models → list user models

4.3 Garment Upload
POST /garments/upload

GET /garments

4.4 Try-On Workflow
POST /tryon → start try-on job (model + garment + optional scene)

Backend triggers BFL /flux-pro-1.0-fill

Store job with returned id

GET /tryon/:id → fetch result (polling /get_result)

4.5 Scene / Background
POST /scene/change → update background with text prompt

Uses flux-pro-1.1 or Fill endpoint depending on operation

4.6 System Prompt Configuration
GET /config/prompts

POST /config/prompts (Admin) → set domain-based prompt

4.7 Usage & Credits
GET /credits/balance

GET /credits/history

##### 5. Data Models (MongoDB)
User: id, email, hash, role, creditsLeft

Model: id, userId, type (uploaded/generated), url, metadata

Garment: id, userId, url, category

Scene: id, name, url, domain

PromptConfig: domain, promptText

TryOnJob: jobId, userId, modelId, garmentId, scene, status, resultUrl

UsageLog: userId, action (model_gen / tryon / scene), creditsUsed, timestamp

##### 6. Workflow Summary
Model Generation Path:

Client → POST /models/generate with prompt and options

Backend → BFL /flux-pro-1.1

Receive polling_url, store job

Poll /get_result, on success, save image URL to DB → return to client

Try-On Path:

POST /tryon with modelId & garmentId

Backend fetches model/garment URLs

Calls BFL /flux-pro-1.0-fill with prompt mask

Poll /get_result, store result, return image

##### 7. Non-Functional Requirements
Async Processing with task queue (BullMQ)

Reliability: exponential backoff polling, option for webhooks

Scaling: support horizontal workers

Security: JWT auth, validate uploads

Logging & Monitoring: track BFL success/fail, credits, quotas

##### 8. Future Extensions
Support Canny and Depth control pipelines

Use webhooks for BFL async callbacks

Allow interior design domain via prompt switch

Finetuning workflows (when required)

High-res ‘Ultra’ modes (flux-pro-1.1-ultra)
