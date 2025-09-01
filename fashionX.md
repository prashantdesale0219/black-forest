# PRD: Black Forest Labs (BFL) Full Integration — Deepnex.Fashionex

**Project**: Deepnex.Fashionex — Backend + Dashboard frontend wiring

**Author**: Assistant
**Date**: 2025-08-23

---

## Goal (single-line)

Remove all traces of any previous virtual-tryon provider and implement **only** Black Forest Labs (BFL) FLUX APIs for every image generation/editing flow (model generation, outfit application via inpainting, background change, user-photo try-on). Update backend, DB model, polling, and dashboard frontend to use BFL as the single provider.

You mentioned you have 200 free trial credits on BFL — good for development and initial QA.

---

## High-level deliverables

1. Replace previous provider code entirely with `backend/services/bflService.js`. No legacy provider code should be invoked in production.
2. Update task model to be provider-**agnostic** but default `provider: 'bfl'`. Remove all references to the old provider from docs and code comments.
3. Update task polling service to understand BFL's async model and normalize statuses.
4. Update controllers and routes to call BFL-only flows: `generateModel`, `applyOutfit`, `changeBackground`, `userTryOn`.
5. Frontend Dashboard: connect to new backend endpoints and UI for mode selector (Default Model, Generate Model, Upload Photo, Background presets) + mask editor + polling UI.
6. Update `.env.example`, README, and deployment docs to only reference BFL.
7. Provide QA checklist, migration script (only to keep DB compatibility when renaming fields), and rollout steps.

---

## Environment variables (required)

Update `.env` / `.env.example` with these keys (only BFL-related keys):

```
PORT=5000
MONGODB_URI=...
JWT_SECRET=...
CLIENT_URL=...

# Black Forest Labs
BFL_API_KEY=sk-REPLACE-ME
BFL_API_BASE=https://api.bfl.ai
BFL_MODEL_IMAGE=flux-pro-1.1
BFL_MODEL_FILL=flux-pro-1.0-fill

UPLOAD_PATH=./uploads
```

---

## Database changes

**File:** `backend/models/TryOnTask.js` — update schema to the following minimal, provider-agnostic structure (default provider set to `bfl`):

```js
// simplified snippet
const TryOnTaskSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  provider: { type: String, enum: ['bfl'], default: 'bfl' },
  providerTaskId: { type: String, required: true },
  status: { type: String, enum: ['CREATED','PROCESSING','COMPLETED','FAILED'], default: 'CREATED' },
  meta: { type: Object, default: {} },
  providerResponse: { type: Object, default: {} },
  result: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});
```

**Notes:**

* If your DB contains older fields named differently, run a migration to copy them into `providerTaskId` and set `provider='bfl'`.
* Don't keep legacy provider-specific names in the schema or docs.

---

## Backend API (BFL-only)

Keep a minimal, clear set of endpoints for the dashboard frontend to use:

1. `POST /api/tryon` — unified entry for create operations.

   * Body: `{ mode: 'generateModel'|'applyOutfit'|'changeBackground'|'userTryOn', prompt?, imageBase64?, maskBase64?, width?, height?, options? }`
   * Returns: `{ success:true, tryOnTaskId, providerTaskId }`

2. `GET /api/tryon/:tryOnTaskId` — get stored DB record with status and result URL(s).

3. `GET /api/bfl/task/:providerTaskId` — direct provider task status (optional; useful for debugging).

4. `POST /api/bfl/generate` — helper (if you want direct generate endpoint): `{ prompt, width, height }` → returns `{ providerTaskId }`.

5. `POST /api/bfl/edit` — helper for image+mask edits: `{ imageBase64, maskBase64, prompt, width, height }` → `{ providerTaskId }`.

**Design decision:** Keep a single `POST /api/tryon` for dashboard simplicity and branch on `mode` server-side. This centralizes audit/logging and user quotas.

---

## Backend Implementation — key files & code (BFL-only)

Below are ready-to-use code files/snippets. Adjust imports/paths to match your repo.

### `backend/services/bflService.js` (create this file)

```js
const axios = require('axios');

class BflService {
  constructor(){
    this.base = process.env.BFL_API_BASE || 'https://api.bfl.ai';
    this.key = process.env.BFL_API_KEY;
    if(!this.key) console.warn('BFL_API_KEY not set');
    this.client = axios.create({ baseURL: this.base, headers: { Authorization: `Bearer ${this.key}` } });
  }

  async createImage({ prompt, width=1024, height=1024, model = process.env.BFL_MODEL_IMAGE }){
    // POST to model endpoint
    const res = await this.client.post(`/v1/${model}`, { prompt, width, height });
    return { taskId: res.data.id || res.data.taskId || null, raw: res.data };
  }

  async editImageWithMask({ image, mask, prompt, width=1024, height=1024, model = process.env.BFL_MODEL_FILL }){
    const res = await this.client.post(`/v1/${model}`, { prompt, image, mask, width, height });
    return { taskId: res.data.id || res.data.taskId || null, raw: res.data };
  }

  async getTask(taskId){
    const res = await this.client.get(`/v1/tasks/${taskId}`);
    return res.data;
  }
}

module.exports = new BflService();
```

### `backend/controllers/tryonController.js` (create/replace relevant functions)

```js
const BflService = require('../services/bflService');
const TryOnTask = require('../models/TryOnTask');

exports.createTryOn = async (req, res) => {
  try{
    const { mode, prompt, imageBase64, maskBase64, width, height, options } = req.body;
    if(!mode) return res.status(400).json({ error: 'mode required' });

    if(mode === 'generateModel'){
      const job = await BflService.createImage({ prompt, width, height, options });
      const t = new TryOnTask({ userId: req.user._id, provider: 'bfl', providerTaskId: job.taskId, status: 'CREATED', meta: { mode, prompt } });
      await t.save();
      return res.json({ success:true, tryOnTaskId: t._id, providerTaskId: job.taskId });
    }

    if(mode === 'applyOutfit' || mode === 'changeBackground' || mode === 'userTryOn'){
      if(!imageBase64 || !maskBase64) return res.status(400).json({ error: 'imageBase64 and maskBase64 required' });
      const job = await BflService.editImageWithMask({ image: imageBase64, mask: maskBase64, prompt, width, height, options });
      const t = new TryOnTask({ userId: req.user._id, provider: 'bfl', providerTaskId: job.taskId, status: 'CREATED', meta: { mode, prompt } });
      await t.save();
      return res.json({ success:true, tryOnTaskId: t._id, providerTaskId: job.taskId });
    }

    return res.status(400).json({ error: 'unsupported mode' });
  }catch(err){
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
```

### `backend/services/taskPollingService.js` (replace polling logic)

```js
const BflService = require('./bflService');
const TryOnTask = require('../models/TryOnTask');
const Asset = require('../models/Asset');
const fs = require('fs');
const path = require('path');

async function pollPendingTasks(){
  const tasks = await TryOnTask.find({ status: { $in: ['CREATED','PROCESSING'] }, provider: 'bfl' });
  for(const t of tasks){
    try{
      const providerResp = await BflService.getTask(t.providerTaskId);
      t.providerResponse = providerResp;
      const st = (providerResp.status || providerResp.state || '').toLowerCase();
      if(['succeeded','success','completed'].includes(st)){
        t.status = 'COMPLETED';
        const output = (providerResp.outputs && providerResp.outputs[0]) || providerResp.result?.[0] || providerResp.data?.[0];
        if(output){
          const asset = await saveOutput(output, t._id);
          t.result = { assetId: asset._id, url: asset.url };
        }
      } else if(['failed','error'].includes(st)){
        t.status = 'FAILED';
      } else {
        t.status = 'PROCESSING';
      }
      await t.save();
    }catch(e){
      console.error('Polling error', e.message);
      t.lastError = e.message;
      await t.save();
    }
  }
}

async function saveOutput(output, tryOnId){
  const uploads = process.env.UPLOAD_PATH || path.join(__dirname, '..', 'uploads');
  if(!fs.existsSync(uploads)) fs.mkdirSync(uploads, { recursive: true });
  const filename = `tryon_${tryOnId}_${Date.now()}.png`;
  const filepath = path.join(uploads, filename);
  if(output.url){
    const resp = await BflService.client.get(output.url, { responseType: 'arraybuffer' });
    fs.writeFileSync(filepath, resp.data);
  } else if(output.b64_json || output.base64){
    const b64 = output.b64_json || output.base64;
    const data = b64.replace(/^data:image\/[a-z]+;base64,/, '');
    fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
  }
  const asset = new Asset({ filename, path: filepath, url: `/uploads/${filename}` });
  await asset.save();
  return asset;
}

module.exports = { pollPendingTasks };
```

> Adjust model imports & field names to match your codebase. These are drop-in templates.

---

## Frontend Dashboard (connectivity + UX)

**Goal:** Dashboard must use new backend endpoints and present mode options to the user.

### Key changes

1. Replace any old provider calls in `frontend/src/services/api.js` to call `/api/tryon` with `{ mode, prompt, imageBase64, maskBase64 }`.
2. Add a React `ModeSelector` component that sets `mode` to one of: `generateModel`, `applyOutfit`, `changeBackground`, `userTryOn`.
3. Add `MaskEditor` component (canvas-based) for users to paint the mask or upload mask PNGs.
4. Add `useTryOnTask` hook (polling) to poll `/api/tryon/:tryOnTaskId` and show progress + final images.

### Frontend polling hook (example)

```js
import { useEffect, useState } from 'react';
export function useTryOnTask(tryOnTaskId){
  const [task, setTask] = useState(null);
  useEffect(()=>{
    if(!tryOnTaskId) return;
    let cancelled=false;
    async function poll(){
      const res = await fetch(`/api/tryon/${tryOnTaskId}`);
      const json = await res.json();
      if(cancelled) return;
      setTask(json);
      if(['COMPLETED','FAILED'].includes(json.status)) return;
      setTimeout(poll, 1500);
    }
    poll();
    return ()=>{ cancelled=true; };
  },[tryOnTaskId]);
  return task;
}
```

---

## Prompts & Presets (store in repo as JSON) — example `bflPrompts.json`

```json
{
  "defaultModel": "studio portrait of 24yo Indian female model, medium shot, plain white bg, ecommerce lighting, realistic skin texture",
  "bgStudio": "minimalist fashion studio, soft shadows, high-key lighting",
  "outfitTShirt": "replace upper clothing with fitted white cotton t-shirt, realistic texture, natural folds"
}
```

---

## QA checklist (BFL-only)

1. Set BFL env keys and start backend.
2. POST `/api/tryon` with `mode=generateModel` and a simple prompt — confirm DB record, providerTaskId present.
3. POST `/api/tryon` with `mode=applyOutfit` (imageBase64+maskBase64) — confirm DB record.
4. Run poller and confirm `COMPLETED` status and asset created in uploads.
5. Dashboard should allow mode selection, mask upload/edit, and preview final image.
6. Validate error messages on BFL quota or rate-limit responses.

---

## Rollout & Monitoring

* Feature-flag `USE_BFL=true` during rollout. Default to true once tested.
* Monitor task queue length, API error rates, and BFL quota consumption.
* Implement soft-failure: when BFL limits reached, inform user and enqueue job for later retry.

---

## Deliverables I will produce if you want now

1. A clean git patch bundle containing the files above (create & modify) so you can apply with `git apply`.
2. Frontend example components (ModeSelector, MaskEditor stub, TryOnPreview) in React.
3. Help apply the changes into your repo: I can generate exact diffs tailored to paths in your repo if you want.

---

If this looks good, tell me: "Make patch bundle" — I will generate a downloadable patch you can apply directly. If you want specific files patched in your repo structure, say `apply to repo paths` and I'll produce diffs matching the repo.
