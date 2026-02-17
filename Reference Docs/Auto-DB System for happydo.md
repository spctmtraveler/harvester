# **Auto-DB System for happydo.xyz — Developer Guide (Phase 2\)**

This document explains the **automatic database provisioning system** running on `happydo.xyz`. It’s designed so any new app can get its own MySQL database with **no manual setup in the DreamHost panel** after the initial pool is created.

It covers:

1. **Architecture overview**

2. **Core files and responsibilities**

3. **Universal database schema (4 shared tables)**

4. **Security model (shared key \+ .htaccess)**

5. **How apps should use `DBHelper`**

6. **How to inspect / debug the system**

7. **Operational tips & gotchas**

---

## **1\. Architecture Overview**

### **Goal**

Give each app on `happydo.xyz` its **own MySQL database** from a pre-created pool, without needing to log into DreamHost each time. All DB connections are:

* Assigned **once per app** via a registry file.

* Routed through a **single secure PHP proxy**.

* Accessed from the front-end via a **shared JS helper**.

### **High-level flow**

1. DreamHost panel has a pool of databases:

   * `appdb_1`, `appdb_2`, ..., `appdb_10`

   * All are accessible by the MySQL user `auto_db`.

2. When an app first starts, it calls `DBHelper.init(appName)` in JavaScript.

3. `DBHelper` calls `db_router.php?action=claim&app=APP_NAME`.

   * If the app already owns a DB, the router returns that DB name.

   * If not, the router assigns the first free `appdb_X` and records it in `db_registry.json`.

4. When the app runs queries, it calls `DBHelper.query(appName, sql, params)`.

5. `DBHelper` sends this to `sql_proxy.php`, which:

   * Looks up the app’s DB in `db_registry.json`.

   * Connects to that DB using `auto_db` credentials.

   * Ensures the **universal tables** exist.

   * Executes the SQL and returns JSON.

   * Logs the query to `db_log.txt`.

6. All of this is protected by a **shared secret key** enforced in `.htaccess`.

---

## **2\. Core Files and Responsibilities**

All files live in:

/home/dh\_dn8qrj/happydo.xyz/api\_auto\_db/

### **2.1 `db_router.php`**

**Role:** Manages the pool of databases and assigns them to apps.

**Key behaviors:**

On first run, if `db_registry.json` doesn’t exist, it initializes it with:

 {  
  "appdb\_1": {"status": "free"},  
  "appdb\_2": {"status": "free"},  
  ...  
  "appdb\_10": {"status": "free"}  
}

*   
* `action=list` → returns the full registry.

* `action=claim&app=APP_NAME`:

  * If APP\_NAME already owns a DB, returns that DB.

  * Else finds the first `status = free`, marks it as used, records `owner` and `claimed_at`.

* `action=release&app=APP_NAME`:

  * Marks any DBs owned by that app as `free` again.

**Important details:**

* Reads and writes `db_registry.json` as a plain JSON file.

* Paths are relative to its own directory (uses `__DIR__`).

* Security is handled by `.htaccess`, not inside the PHP itself.

### **2.2 `sql_proxy.php`**

**Role:** Central gateway for all SQL queries.

**Responsibilities:**

* Receives JSON POST:

  * `app`: app name (string)

  * `sql`: SQL text (string)

  * `params`: an object with parameter values (optional)

* Looks up the correct DB for `app` in `db_registry.json`.

* Connects to that DB using PDO:

  * Hostname: DreamHost MySQL host

  * User: `auto_db`

  * Password: (stored in this file)

* Ensures the **4 universal tables** exist (see Section 3).

Runs the SQL, returns:

 {  
  "db": "appdb\_X",  
  "rows": \[ {...}, {...} \]  
}

*   
* Logs each query to `db_log.txt` (one JSON line per query), including:

  * Timestamp

  * App name

  * DB name

  * Shortened SQL

  * Params

  * Error message (if any)

**Failure behavior:**

* If app or SQL is missing → `400 Bad Request`.

* If registry missing or DB not assigned → `404 / 500` with JSON error.

* If MySQL connection or query fails → `500` with `error` field, and the error is logged.

### **2.3 `db_helper.js`**

**Role:** Front-end JS helper for any app that wants to use the auto-DB system.

It exports a `DBHelper` object with methods:

* `init(appName)` → ensures a DB is assigned to `appName`.

* `query(appName, sqlText, params)` → runs a SQL query via `sql_proxy.php`.

* `release(appName)` → releases the DB back to the pool (rarely used in real apps).

* `setSetting(appName, keyName, valueText)` → writes to the `settings` table.

* `getSetting(appName, keyName)` → reads from the `settings` table.

* `logEvent(appName, eventType, payloadObj)` → writes to the `action_log` table.

**Local caching:**

Uses `localStorage` key `lnl_db_map` to store:

 {  
  "goals\_app": "appdb\_1",  
  "another\_app": "appdb\_2"  
}

*   
* This makes `init(appName)` fast on subsequent loads.

### **2.4 `db_registry.json`**

**Role:** Simple JSON registry mapping DB names to owners.

**Example:**

{  
  "appdb\_1": {  
    "status": "used",  
    "owner": "goals\_app",  
    "claimed\_at": "2025-11-13T01:18:08-08:00"  
  },  
  "appdb\_2": {  
    "status": "free"  
  },  
  "appdb\_3": {  
    "status": "free"  
  }  
}

You can edit this manually to reset the pool, but the preferred method is via `db_router.php?action=release&app=APP_NAME`.

### **2.5 `db_log.txt`**

**Role:** Append-only log file for all SQL traffic through the proxy.

Each line is a JSON object, e.g.:

{  
  "time": "2025-12-09 22:14:01",  
  "app": "test\_app",  
  "db": "appdb\_2",  
  "sql": "SELECT 1 AS ok",  
  "params": {},  
  "error": null  
}

Use this for debugging, auditing, and performance insights.

### **2.6 `db_dashboard.html`**

**Role:** Minimal admin dashboard for viewing the registry.

* Fetches `db_router.php?action=list` with the shared key.

* Renders a table showing:

  * DB name

  * Status (`free` / `used`)

  * Owner (app name)

  * Timestamp of claim

Useful for quickly seeing which apps are using which DBs.

### **2.7 `.htaccess`**

**Role:** Security gate for the auto-DB endpoints.

* Blocks direct access to `db_router.php` and `sql_proxy.php` unless the URL includes the correct `key=SECRET` query parameter.

* Also disables directory listing.

More in Section 4\.

---

## **3\. Universal Database Schema (4 Shared Tables)**

Each app-specific database (e.g. `appdb_1`) is initialized with the same **universal schema** the first time it’s accessed via `sql_proxy.php`.

This schema is intended to be **minimal, general-purpose infrastructure**, not app-specific business logic.

The 4 tables are:

1. `app_meta`

2. `settings`

3. `kv_store`

4. `action_log`

### **3.1 `app_meta`**

CREATE TABLE IF NOT EXISTS app\_meta (  
  id INT PRIMARY KEY AUTO\_INCREMENT,  
  app\_name VARCHAR(255),  
  created\_at DATETIME,  
  updated\_at DATETIME,  
  schema\_version INT DEFAULT 1  
);

**Purpose:**

* One row describing the app that owns this DB.

* Used for quick identification and future schema migrations.

**Behavior:**

* On first access, `sql_proxy.php` ensures this table exists and inserts a row with:

  * `app_name` \= name passed in the JSON request (`input['app']`).

  * `created_at` and `updated_at` \= `NOW()`.

  * `schema_version` \= `1` (for now).

* On subsequent calls, it updates `updated_at` to `NOW()` (optional heartbeat behavior).

### **3.2 `settings`**

CREATE TABLE IF NOT EXISTS settings (  
  id INT PRIMARY KEY AUTO\_INCREMENT,  
  key\_name VARCHAR(255) UNIQUE,  
  value\_text TEXT,  
  updated\_at DATETIME  
);

**Purpose:**

* Store **global app-level settings** as simple text key-value pairs.

* Examples:

  * `default_theme = "dark"`

  * `challenge_length_days = "21"`

  * `ai_model = "gpt-5.1"`

**Companion helpers in JS:**

* `DBHelper.setSetting(appName, keyName, valueText)`

* `DBHelper.getSetting(appName, keyName)`

These use an `INSERT ... ON DUPLICATE KEY UPDATE` pattern so keys are unique and easy to overwrite.

### **3.3 `kv_store`**

CREATE TABLE IF NOT EXISTS kv\_store (  
  id INT PRIMARY KEY AUTO\_INCREMENT,  
  namespace VARCHAR(255),  
  key\_name VARCHAR(255),  
  value\_json JSON,  
  updated\_at DATETIME,  
  UNIQUE KEY uniq\_ns\_key (namespace, key\_name)  
);

**Purpose:**

* Flexible, general-purpose storage for **structured JSON data**, namespaced by category.

* This is the "junk drawer" for:

  * Per-user preferences

  * Layout configs

  * AI-generated configs and prompts

  * Prototypes and experiments

**Example usages:**

Store user preferences:

 namespace \= "user\_prefs"  
key\_name \= "user\_123"  
value\_json \= {  
  "theme": "dark",  
  "fontSize": 18,  
  "hideTips": true  
}

* 

Store dashboard layout:

 namespace \= "layout"  
key\_name \= "home\_v1"  
value\_json \= {  
  "panels": \["tasks", "calendar", "ai\_tips"\],  
  "weights": \[3,2,1\]  
}

* 

*Note:* There are no specific JS helpers yet for `kv_store`, but it can be accessed via raw `DBHelper.query` or easily wrapped later.

### **3.4 `action_log`**

CREATE TABLE IF NOT EXISTS action\_log (  
  id INT PRIMARY KEY AUTO\_INCREMENT,  
  event\_type VARCHAR(255),  
  payload JSON,  
  created\_at DATETIME  
);

**Purpose:**

* Simple event log inside each app’s DB.

* For tracking app-specific events in a structured way.

**Examples:**

* `event_type = "task_created"`, payload \= `{ "taskId": 123, "title": "Buy milk" }`

* `event_type = "ai_prompt_run"`, payload \= `{ "model": "gpt-5.1", "tokens": 834 }`

**JS helper:**

* `DBHelper.logEvent(appName, eventType, payloadObj)`

This is separate from `db_log.txt`:

* `db_log.txt` \= raw infrastructure log for all apps.

* `action_log` \= semantic, app-level event log.

---

## **4\. Security Model**

The system is protected with a **shared secret key** enforced by `.htaccess`.

### **4.1 Shared secret key**

Choose a random-ish string, for example:

z3Do9mKf8Q\_autoDB\_2025

Use this same string in **three places**:

1. `db_helper.js` → `SECRET_KEY`

2. `.htaccess` → `key=SECRET`

3. `db_dashboard.html` → `SECRET_KEY` inside `<script>`

### **4.2 `.htaccess` behavior**

The `.htaccess` file in `/api_auto_db/` contains rewrite rules like:

RewriteEngine On

\# Block direct access to db\_router.php and sql\_proxy.php  
\# unless the query string contains key=YOUR\_SECRET\_KEY  
RewriteCond %{QUERY\_STRING} \!(^|&)key=YOUR\_SECRET\_KEY(&|$)  
RewriteRule ^(db\_router\\.php|sql\_proxy\\.php)$ \- \[F,L\]

Options \-Indexes

**Effect:**

* Any request to `db_router.php` or `sql_proxy.php` **without** `?key=YOUR_SECRET_KEY` returns `403 Forbidden`.

* Only code that knows the secret key can use the auto-DB system.

### **4.3 How JS attaches the key**

In `db_helper.js`, the endpoints include the key:

const SECRET\_KEY \= "YOUR\_SECRET\_KEY";

const router \= \`https://happydo.xyz/api\_auto\_db/db\_router.php?key=${SECRET\_KEY}\`;  
const sql    \= \`https://happydo.xyz/api\_auto\_db/sql\_proxy.php?key=${SECRET\_KEY}\`;

When `DBHelper` calls `router` or `sql`, it always includes the key in the URL, so `.htaccess` allows the request.

### **4.4 Additional hardening ideas (optional)**

* Restrict access by IP (e.g. only from the main site server).

* Add per-app API keys or tokens in addition to the global key.

* Rate-limit requests at the web server or app level.

---

## **5\. How Apps Should Use `DBHelper`**

This section is for anyone building a new app on `happydo.xyz`.

### **5.1 Import and initialize**

In your app’s HTML/JS:

\<script type="module"\>  
  import { DBHelper } from "https://happydo.xyz/api\_auto\_db/db\_helper.js";

  const appName \= "goals\_app"; // choose a unique, stable ID for your app

  (async () \=\> {  
    const dbName \= await DBHelper.init(appName);  
    console.log("Using DB:", dbName);  
  })();  
\</script\>

**Guidelines for `appName`:**

* Use a simple, unique string.

* Once chosen, don’t change it unless you also manually migrate data or update the registry.

### **5.2 Running queries**

const result \= await DBHelper.query(appName, "SELECT \* FROM settings");  
console.log(result.rows);

**Notes:**

* `result.db` → the DB name (`appdb_1`, etc.).

* `result.rows` → array of result rows.

* On error, the promise rejects; catch it or `try/catch` around it.

### **5.3 Using the settings helper**

// Set a setting  
await DBHelper.setSetting(appName, "default\_theme", "dark");

// Get a setting  
const theme \= await DBHelper.getSetting(appName, "default\_theme");  
console.log("Theme:", theme);

### **5.4 Logging events**

await DBHelper.logEvent(appName, "task\_created", {  
  taskId: 123,  
  title: "Test auto-DB system"  
});

This writes to the `action_log` table in the app’s own DB.

### **5.5 When (and whether) to call `release`**

Most apps **never** need to release their DB.

`release` is mainly for:

* Testing / development

* Recycling DBs if the number is limited and some apps are retired

Usage:

await DBHelper.release(appName);

This:

* Calls `db_router.php?action=release&app=APP_NAME`.

* Clears the cached DB entry in `localStorage`.

* Marks the DB as `free` in `db_registry.json`.

---

## **6\. Inspecting and Debugging the System**

### **6.1 View DB assignments**

Open:

https://happydo.xyz/api\_auto\_db/db\_dashboard.html

* You should see one row per `appdb_X`.

* The `owner` column tells you which app owns which DB.

If you see a `403 Forbidden` error, ensure:

* The `SECRET_KEY` in `db_dashboard.html` matches the one in `.htaccess`.

### **6.2 Inspect logs**

* File: `/home/dh_dn8qrj/happydo.xyz/api_auto_db/db_log.txt`

* Each line is JSON.

* Good for:

  * Confirming which queries ran.

  * Diagnosing failed queries.

### **6.3 Resetting the registry**

**Soft reset (recommended):**

Use the browser to hit:

 https://happydo.xyz/api\_auto\_db/db\_router.php?key=SECRET\&action=release\&app=APP\_NAME

*   
* Then `action=list` to confirm.

**Hard reset (nuclear option):**

* Manually edit `db_registry.json` and set all DBs to `{"status":"free"}`.

* Only do this if you understand that DB ownership info will be lost; data is still in each DB but the system won’t know who owns what until apps re-claim.

### **6.4 Common failure modes**

1. **`Access denied for user 'auto_db'`**

   * MySQL hostname or password in `sql_proxy.php` is incorrect.

   * The `auto_db` MySQL user does not have access to that DB in DreamHost panel.

2. **`No database assigned for this app`**

   * App hasn’t called `DBHelper.init(appName)` yet.

   * Registry file was reset and app hasn’t re-claimed.

3. **`No free DBs`**

   * All DBs in the pool are marked `used`.

   * Either the pool is actually full or some entries need to be released.

4. **`403 Forbidden` when hitting PHP scripts**

   * Missing or incorrect `key=SECRET` in the URL.

   * `.htaccess` secret doesn’t match the one in `db_helper.js` / `db_dashboard.html`.

---

## **7\. Operational Tips & Gotchas**

### **7.1 When adding more databases**

If you need more capacity:

1. In DreamHost panel, create new DBs:

   * `appdb_11`, `appdb_12`, etc.

   * Give the `auto_db` user access to each.

Update `db_registry.json` to include them:

 {  
  "appdb\_1": { "status": "used", ... },  
  ...  
  "appdb\_10": { "status": "free" },  
  "appdb\_11": { "status": "free" },  
  "appdb\_12": { "status": "free" }  
}

2.   
3. The router will automatically start assigning the new ones.

### **7.2 MySQL user management**

* The MySQL user `auto_db` is shared by all app DBs.

* If you change its password in the DreamHost panel, you **must** update `sql_proxy.php` to match, or everything will break.

### **7.3 LocalStorage considerations**

* `DBHelper` caches DB assignments in `localStorage`.

* If you ever manually reassign a DB in `db_registry.json`, you may want to clear localStorage in your browser so the cached mapping isn’t stale.

### **7.4 Schema evolution**

* `schema_version` in `app_meta` is there for future migrations.

* When updating the universal schema, you can:

  * Check `schema_version`.

  * Run migration SQL accordingly.

  * Bump `schema_version`.

### **7.5 Decommissioning an app**

To fully retire an app:

1. Stop calling `DBHelper` in its front-end.

2. Optionally back up its DB (`appdb_X`).

Release it from the pool:

 https://happydo.xyz/api\_auto\_db/db\_router.php?key=SECRET\&action=release\&app=APP\_NAME

3.   
4. Optionally drop the DB from DreamHost panel if space is needed.

---

## **8\. Summary**

This auto-DB system gives you:

* A **standardized way** for any app on `happydo.xyz` to get its own MySQL database.

* A **universal schema** for shared infrastructure (settings, kv\_store, logs).

* A **single secure proxy** for all DB access.

* A **lightweight JS helper** that keeps app code simple.

* A **registry and dashboard** to see which app owns which DB.

Future coders should:

1. Use `DBHelper` for all DB interactions.

2. Give each new app a unique `appName`.

3. Avoid talking to MySQL directly; always go through `sql_proxy.php`.

4. Use the universal tables where possible before creating app-specific ones.

5. Check `db_log.txt` and `db_dashboard.html` when debugging.

This keeps the ecosystem coherent, secure, and easy to extend over time.

