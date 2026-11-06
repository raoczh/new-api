const IMAGE_MODELS = [
  "gpt-image-1", "gpt-image-1.5", "gpt-image-2", "gpt-image-2-asynchronous",
  "gpt-image-2.5", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst",
  "gpt-image-2.6", "gpt-image-2.6-flare", "gpt-image-2.6-sunburst",
  "nano_banana_2", "nano-banana-2.1", "nano_banana_pro",
  "grok-imagine-image-lite", "doubao-seedream-4.0", "doubao-seedream-4.5", "doubao-seedream-5.0",
  "cogview-3-flash", "cogview-4", "cogview-4-250304", "glm-image", "hy-image-lite", "spark-image",
];

export const meta = {
  apiVersion: 1,
  key: "zhiqi",
  name: "Zhiqi",
  version: "1.0.0",
  author: { name: "QuantumNous" },
  description: { en: "Zhiqi asynchronous image generation and editing", zh: "志奇异步图片生成与编辑" },
  models: IMAGE_MODELS,
  fetchMode: "per_task",
  upstreams: ["vendor", "new_api"],
  usageSchema: {
    image_count: {
      type: "number", unit: "count",
      unitLabel: { en: "image", zh: "张" },
      description: { en: "Image generation unit price", zh: "图片生成单价" },
    },
  },
  routes: [
    { method: "POST", path: "/v1/images/generations/async", type: "submit", decode: "createImage", render: "imageCreated" },
    { method: "GET", path: "/v1/images/generations/:task_id", type: "query", render: "imageStatus" },
  ],
};

const REQUEST_FIELDS = [
  "model", "prompt", "n", "size", "resolution", "aspect_ratio", "quality", "response_format",
  "output_format", "output_compression", "frame_count", "frame_duration_ms", "reference_image_urls", "mask", "stream",
];
const STATUS_MAP = { queued: "QUEUED", in_progress: "IN_PROGRESS", succeeded: "SUCCESS", failed: "FAILURE" };

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function integerField(value, name, minimum, maximum) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum)
    throw new Error(name + " must be an integer between " + minimum + " and " + maximum);
  return value;
}

function httpImageURL(value, name) {
  if (typeof value !== "string" || !/^https?:\/\/[^/?#\s@]+(?:[/?#][^\s]*)?$/i.test(value) || /[\\\u0000-\u001f\u007f]/.test(value))
    throw new Error(name + " must be an HTTP(S) URL; files, Base64 and data URLs are not supported");
  return value;
}

// Validate the exact body sent upstream, including on the generic task entry.
// Resolution/aspect-ratio mapping and model-specific capability checks belong
// to the provider. Never invent a size table or a default quality here.
function imageRequest(source, upstreamModel) {
  if (!plainObject(source)) throw new Error("JSON object required");
  for (const name of Object.keys(source)) {
    if (!REQUEST_FIELDS.includes(name)) throw new Error("unsupported parameter: " + name);
  }
  if (typeof source.model !== "string" || !source.model.trim()) throw new Error("model is required");
  if (typeof source.prompt !== "string" || !source.prompt.trim()) throw new Error("prompt is required");
  if (Array.from(source.prompt).length > 32000) throw new Error("prompt must not exceed 32000 characters");
  const body = { model: upstreamModel || source.model, prompt: source.prompt, n: 1, response_format: "url" };
  if (source.n !== undefined) integerField(source.n, "n", 1, 1);
  if (source.response_format !== undefined && source.response_format !== "url") throw new Error("response_format must be url");
  if (source.stream !== undefined && source.stream !== false) throw new Error("stream is not supported for asynchronous images");
  for (const name of ["size", "resolution", "aspect_ratio", "quality", "output_format"]) {
    if (source[name] === undefined) continue;
    if (name === "size" && source.resolution !== undefined && source.aspect_ratio !== undefined) continue;
    if (typeof source[name] !== "string" || !source[name].trim()) throw new Error(name + " must be a non-empty string");
    body[name] = source[name];
  }
  if (body.size !== undefined && body.size !== "auto" && !/^[1-9]\d*:[1-9]\d*$/.test(body.size)) {
    const dimensions = /^([1-9]\d*)x([1-9]\d*)$/.exec(body.size);
    if (!dimensions || Number(dimensions[1]) > 4096 || Number(dimensions[2]) > 4096)
      throw new Error("size must be auto, an aspect ratio, or widthxheight with each side at most 4096");
  }
  if (body.aspect_ratio !== undefined && !/^[1-9]\d*:[1-9]\d*$/.test(body.aspect_ratio)) throw new Error("aspect_ratio must be width:height");
  if (body.quality !== undefined && !["auto", "low", "medium", "high", "xhigh", "max"].includes(body.quality)) throw new Error("unsupported quality");
  if (body.output_format !== undefined && !["png", "jpeg", "webp", "svg", "gif"].includes(body.output_format)) throw new Error("unsupported output_format");
  // These are syntax bounds, not claims that every listed model supports GIF.
  // The final upstream route remains authoritative for model capabilities.
  if (source.output_compression !== undefined) {
    if (!["jpeg", "webp"].includes(body.output_format)) throw new Error("output_compression requires jpeg or webp");
    body.output_compression = integerField(source.output_compression, "output_compression", 0, 100);
  }
  for (const name of ["frame_count", "frame_duration_ms"]) {
    if (source[name] === undefined) continue;
    if (body.output_format !== "gif") throw new Error(name + " requires output_format=gif");
    body[name] = name === "frame_count" ? integerField(source[name], name, 2, 16) : integerField(source[name], name, 20, 655350);
  }
  if (source.reference_image_urls !== undefined) {
    if (!Array.isArray(source.reference_image_urls) || source.reference_image_urls.length > 16)
      throw new Error("reference_image_urls must be an array of at most 16 HTTP(S) URLs");
    body.reference_image_urls = source.reference_image_urls.map(function (value, index) {
      return httpImageURL(value, "reference_image_urls[" + index + "]");
    });
  }
  if (source.mask !== undefined) {
    if (!body.reference_image_urls || !body.reference_image_urls.length) throw new Error("mask requires a reference image");
    body.mask = httpImageURL(source.mask, "mask");
  }
  return body;
}

function apiRoot(ctx) {
  // The engine flag selects the documented wire protocol even on New API
  // channels. An upstream need not be another gateway running this plugin.
  return ctx.baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
}

function imagePayloadCount(data) {
  const entries = Array.isArray(data) ? data : plainObject(data) ? [data] : [];
  let urls = 0;
  let encodedImages = 0;
  for (const entry of entries) {
    if (!plainObject(entry)) continue;
    if (typeof entry.url === "string" && entry.url.trim()) urls++;
    if (typeof entry.b64_json === "string" && entry.b64_json.trim()) encodedImages++;
  }
  return Math.max(urls, encodedImages);
}

function generationState(previous, body) {
  const state = plainObject(previous) ? utils.json.clone(previous) : {};
  // 99% means generation finished but hosted media is not delivered yet.
  // Keep this evidence across later polling errors/timeouts and snapshots.
  if ((body.status === "in_progress" && /^(99|99%)$/.test(String(body.progress))) ||
      (body.status === "succeeded" && imagePayloadCount(body.data) > 0) ||
      (body.status === "failed" && plainObject(body.error) && body.error.code === "media_storage_failed"))
    state.generationCompleted = true;
  return state;
}

function imageTask(task) {
  const data = plainObject(task.data) ? task.data : {};
  const statuses = { NOT_START: "queued", SUBMITTED: "queued", QUEUED: "queued", IN_PROGRESS: "in_progress", SUCCESS: "succeeded", FAILURE: "failed" };
  const body = { id: task.task_id, object: "image.task", status: statuses[task.status] || "queued", progress: task.progress || "0%" };
  if (data.created !== undefined) body.created = data.created;
  else if (task.created_at) body.created = task.created_at;
  if (typeof data.model === "string") body.model = data.model;
  if (body.status === "succeeded" || body.status === "failed") {
    if (data.completed_at !== undefined) body.completed_at = data.completed_at;
    else if (task.finished_at) body.completed_at = task.finished_at;
  }
  if (body.status === "succeeded" && data.data !== undefined) body.data = data.data;
  if (plainObject(data.metadata) && data.metadata.upstream_usage !== undefined)
    body.metadata = { upstream_usage: data.metadata.upstream_usage };
  if (body.status === "failed") {
    body.error = plainObject(data.error) ? { code: data.error.code, message: data.error.message } :
      { code: "task_failed", message: task.fail_reason || "Image generation failed" };
  }
  return body;
}

export const native = {
  createImage(ctx) {
    if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required; file uploads are not supported");
    const body = imageRequest(ctx.body.value);
    return { kind: "submit", model: body.model, action: body.reference_image_urls && body.reference_image_urls.length ? "image_edit" : "image_generation", requestBody: body };
  },
  imageCreated(ctx, task) { return { __status: 202, __body: imageTask(task) }; },
  imageStatus(ctx, task) { return imageTask(task); },
  error(ctx, error) { return { error: { code: error.code, message: error.message } }; },
};

export function buildSubmitRequest(ctx) {
  return {
    url: apiRoot(ctx) + "/v1/images/generations/async", method: "POST",
    headers: { Authorization: "Bearer " + ctx.apiKey, "Content-Type": "application/json" },
    body: imageRequest(ctx.requestBody, ctx.upstreamModel || ctx.model),
  };
}

export function extractUsage(ctx) {
  imageRequest(ctx.requestBody, ctx.upstreamModel || ctx.model);
  return { image_count: 1 };
}

export function parseSubmitResponse(ctx, response) {
  const body = response.body;
  if (!plainObject(body) || typeof body.id !== "string" || !body.id || body.object !== "image.task" || !STATUS_MAP[body.status])
    throw new Error("Invalid upstream image.task submission response");
  const taskData = utils.json.clone(body);
  taskData.model = ctx.model;
  // Even a fast terminal reply remains a durable task and is reconciled by
  // the poller, so failed media delivery retains its known generation charge.
  return { taskId: body.id, taskData: taskData, state: generationState(null, body) };
}

export function buildQueryRequest(ctx) {
  return {
    url: apiRoot(ctx) + "/v1/images/generations/" + encodeURIComponent(ctx.taskId), method: "GET",
    headers: { Authorization: "Bearer " + ctx.apiKey },
  };
}

export function parseTaskResult(ctx, body) {
  if (!plainObject(body) || body.object !== "image.task" || body.id !== ctx.taskId || !STATUS_MAP[body.status]) return { status: "UNKNOWN" };
  const result = { taskId: ctx.taskId, status: STATUS_MAP[body.status], state: generationState(ctx.state, body) };
  if (typeof body.progress === "string" && /^(100|[1-9]?\d)%?$/.test(body.progress)) result.progress = body.progress;
  if ((body.status === "queued" || body.status === "in_progress") && (result.progress === "100" || result.progress === "100%")) result.progress = "99%";
  if (plainObject(body.error) && typeof body.error.message === "string") result.reason = body.error.message;
  const usage = plainObject(body.metadata) && plainObject(body.metadata.upstream_usage) ? body.metadata.upstream_usage : null;
  if (usage) {
    // Never read quota/cost/amount as tokens, or invent absent upstream usage.
    if (Number.isSafeInteger(usage.total_tokens) && usage.total_tokens >= 0) result.totalTokens = usage.total_tokens;
    if (Number.isSafeInteger(usage.output_tokens) && usage.output_tokens >= 0) result.completionTokens = usage.output_tokens;
  }
  return result;
}

export function extractUsageOnComplete(ctx, result, body) {
  if (!plainObject(body) || body.status !== "succeeded") return {};
  const count = imagePayloadCount(body.data);
  // Payload-less, zero and invalid counts retain the reserved request count.
  return count > 0 && count <= 128 ? { image_count: count } : {};
}
