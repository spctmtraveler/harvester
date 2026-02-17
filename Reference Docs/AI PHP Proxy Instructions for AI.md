Here’s a complete, focused **project-ready reference document** so other projects know exactly how to leverage your secure AI proxy and JavaScript library.

---

\# 🧠 LiveNeuron Labs — AI Proxy \+ JS Library Integration Guide  
\*\*Version:\*\* 1.0  
\*\*Location:\*\* \`/api/aiproxy.php\` \+ \`/api/ailnl.js\`  
\*\*Purpose:\*\* Allow any web app under \`happydo.xyz\` (or approved domains) to call OpenAI / Gemini safely without exposing API keys.

\---

\#\# 🚀 Overview  
Your \`/api\` directory hosts a \*\*secure server-side relay (aiproxy.php)\*\* and a \*\*front-end helper library (ailnl.js)\*\*.

Together they form a “safe AI tunnel”:

Browser App → ailnl.js → aiproxy.php → OpenAI / Gemini APIs  
↑  
Keys stay private (.env)

All sub-apps (e.g., \`/8Questions\_v15\`, \`/aichat\`, \`/altprotein\`) can import the shared JS library to get instant AI capability.

\---

\#\# 📂 Files

| File | Role |
| :---- | :---- |
| \`/api/aiproxy.php\` | Secure PHP relay. Loads API keys from \`.env\`. Supports rate-limiting, logging, OpenAI & Gemini calls. |
| \`/api/ailnl.js\` | ES6 module for front-end use. Handles prompts, model selection, auto-defaults, and metadata lookup. |
| \`/api/aiproxy.log\` | Rotating request log (1 MB max per file). |
| \`/api/tester.html\` | Reference app to verify everything works. |

\---

\#\# 🔑 .env Setup (two levels above public root)  
Located at: \`/home/dh\_dn8qrj/.env\`

OPENAI\_API\_KEY=sk-...  
GEMINI\_API\_KEY=AIza...

Never place \`.env\` inside \`happydo.xyz\` — it must remain one level up for security.

\---

\#\# 🧱 Using the Library in Any App

\#\#\# 1️⃣ Import the module

Inside any HTML file under \`happydo.xyz\`:

\`\`\`html  
\<script type="module"\>  
import { askAI } from "[https://happydo.xyz/api/ailnl.js](https://happydo.xyz/api/lnlai.js)";

const reply \= await askAI("Write a haiku about the ocean", "openai");  
console.log(reply);  
\</script\>

✅ Works automatically across all sub-folders (same domain \= no CORS issue).

---

### **2️⃣ Available functions**

#### **askAI(prompt, model?, options?)**

Sends a prompt through your PHP proxy.

const text \= await askAI("Explain quantum foam", "gemini");

| Parameter | Type | Default | Description |
| :---- | :---- | :---- | :---- |
| prompt | string | — | The text to send. |
| model | string | `"openai"` | `"openai"`, `"gemini"`, or a specific model (`"gpt-4o"`, `"gemini-1.5-pro"`, etc.) |
| options.endpoint | string | proxy URL | Override if using a different proxy. |
| options.temperature | number | `0.7` | Controls creativity. |

Returns → AI response as plain text.

---

#### **getAvailableModels({refresh})**

Lists known OpenAI \+ Gemini models (cached 1 hour).

const models \= await getAvailableModels();  
console.log(models.openai);  
console.log(models.gemini);

---

#### **resolveDefaultModel(modelName)**

Expands `"openai"` / `"gemini"` to best current version (e.g. `"gpt-5"` or `"gemini-1.5-pro"`).

---

#### **describeModel(modelId)**

Returns metadata about a specific model (if accessible).  
If the public API blocks it, returns `{error: "..."}`

const info \= await describeModel("gemini-1.5-pro");  
console.table(info);

---

## **🧠 Supported Models**

### **✅ OpenAI**

* `gpt-5` *(auto-detected when available)*  
    
* `gpt-4o`, `gpt-4o-mini`  
    
* `gpt-3.5-turbo`  
    
* `o1-preview`

### **✅ Gemini**

* `gemini-1.5-pro`  
    
* `gemini-1.5-flash`  
    
* `gemini-pro`

(Any future models beginning with `gpt-`, `o1-`, or `gemini-` are supported automatically.)

---

## **🔒 Security & Limits**

* Keys never leave the server.  
    
* Per-IP rate limit: **10 requests / minute** (configurable in `aiproxy.php`).  
    
* Requests logged to `/api/aiproxy.log`.  
    
* Log auto-rotates at 1 MB.

To whitelist new domains, edit:

$allowed\_origins \= \['[https://happydo.xyz','https://liveneuronlabs.com'\\\]](https://happydo.xyz','https://liveneuronlabs.com'\\]);

---

## **🧩 Common Issues**

| Symptom | Likely Cause | Fix |
| :---- | :---- | :---- |
| 401 / 403 in console | Browser can’t access model-list endpoints | Harmless – library uses fallback models |
| 500 “Unsupported model” | Proxy version outdated | Ensure you’re running latest `aiproxy.php` (auto-detects GPT \+ Gemini) |
| Empty response | Model not reachable | Verify API key validity in `.env` |

---

## **🧰 Extending This System**

### **Add more providers**

Duplicate the pattern in `aiproxy.php` for Anthropic, Mistral, etc.

### **Add server-side model discovery**

Expose `/api/aiproxy.php?models` so `ailnl.js` can query model lists securely via your server (no 401s).

### **Add app authentication**

Insert a shared token check in `aiproxy.php` for multi-tenant or public use.

---

## **🧪 Testing**

Visit  
👉 [https://happydo.xyz/api/tester.html](https://happydo.xyz/api/tester.html)

Type a prompt, choose “OpenAI (auto)” or “Gemini (auto)”, click **Send to AI**.  
You should see a live model response and a `(No metadata available)` line (normal for browsers without API keys).

---

## **✅ Summary**

| Component | Purpose |
| :---- | :---- |
| **aiproxy.php** | Server relay – keeps keys private |
| **ailnl.js** | Client helper – makes AI calls simple |
| **.env** | Stores API keys securely |
| **tester.html** | Verifies end-to-end functionality |

---

*Authored for LiveNeuron Labs internal projects*  
*(Last updated: 2025-10-18)*

\---

Would you like me to generate a nicely formatted \*\*HTML version\*\* of that same document (with collapsible sections and code blocks styled for internal dev portals)?  
