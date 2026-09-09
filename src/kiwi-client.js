/**
 * Minimal JSON-RPC 2.0 client for the Kiwi TCMS API.
 *
 * Kiwi exposes every RPC method at  <base>/json-rpc/  and authenticates with a
 * session cookie obtained from `Auth.login(username, password)`. This client logs
 * in lazily on the first call, reuses the `sessionid` cookie for every subsequent
 * request, and transparently re-logs-in once if the session has expired.
 *
 * Docs: https://kiwitcms.readthedocs.io/en/latest/modules/tcms.rpc.api.html
 */

export class KiwiError extends Error {
  constructor(method, rpcError, params) {
    const detail =
      rpcError && typeof rpcError === "object"
        ? `${rpcError.message ?? "unknown error"}${
            rpcError.code != null ? ` (code ${rpcError.code})` : ""
          }`
        : String(rpcError);
    super(`Kiwi RPC ${method} failed: ${detail}`);
    this.name = "KiwiError";
    this.method = method;
    this.rpcError = rpcError;
    this.params = params;
  }
}

function looksLikeAuthProblem(rpcError) {
  if (!rpcError) return false;
  const code = rpcError.code;
  const msg = String(rpcError.message ?? "").toLowerCase();
  return (
    code === -32000 ||
    msg.includes("login") ||
    msg.includes("authenticat") ||
    msg.includes("permission denied") ||
    msg.includes("anonymous")
  );
}

export class KiwiClient {
  /**
   * @param {object} opts
   * @param {string} opts.url       Base URL, e.g. https://kiwi.sofstica.com:8443
   * @param {string} opts.username
   * @param {string} opts.password
   */
  constructor({ url, username, password }) {
    if (!url) throw new Error("KIWI_URL is required");
    if (!username) throw new Error("KIWI_USERNAME is required");
    if (!password) throw new Error("KIWI_PASSWORD is required");

    this.endpoint = url.replace(/\/+$/, "") + "/json-rpc/";
    this.username = username;
    this.password = password;
    this.sessionId = null;
    this._id = 0;
    this._loginInFlight = null;
  }

  async _post(body, { withSession }) {
    const headers = { "Content-Type": "application/json" };
    if (withSession && this.sessionId) {
      headers.Cookie = `sessionid=${this.sessionId}`;
    }
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const raw = await res.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(
        `Kiwi returned non-JSON (HTTP ${res.status}) from ${this.endpoint}: ` +
          raw.slice(0, 300)
      );
    }
    return { res, payload };
  }

  async _login() {
    // Collapse concurrent logins into one request.
    if (this._loginInFlight) return this._loginInFlight;

    this._loginInFlight = (async () => {
      const { res, payload } = await this._post(
        {
          jsonrpc: "2.0",
          method: "Auth.login",
          params: [this.username, this.password],
          id: ++this._id,
        },
        { withSession: false }
      );

      if (payload.error) {
        throw new KiwiError("Auth.login", payload.error, ["<username>", "***"]);
      }
      const sid = payload.result;
      if (!sid || typeof sid !== "string") {
        // Some deployments only return the cookie via Set-Cookie.
        const setCookie = res.headers.get("set-cookie") || "";
        const m = setCookie.match(/sessionid=([^;]+)/);
        if (m) {
          this.sessionId = m[1];
          return this.sessionId;
        }
        throw new Error(
          "Auth.login succeeded but no session id was returned. " +
            "Check that KIWI_URL points at the Kiwi host root (no path)."
        );
      }
      this.sessionId = sid;
      return sid;
    })();

    try {
      return await this._loginInFlight;
    } finally {
      this._loginInFlight = null;
    }
  }

  /**
   * Call any Kiwi RPC method.
   * @param {string} method  e.g. "TestCase.filter"
   * @param {any[]}  params  positional params array (Kiwi RPC is positional)
   * @returns {Promise<any>} the `result` field of the JSON-RPC response
   */
  async call(method, params = []) {
    if (!Array.isArray(params)) {
      throw new Error(
        `params for ${method} must be an array (Kiwi RPC is positional); got ${typeof params}`
      );
    }

    if (method !== "Auth.login" && !this.sessionId) {
      await this._login();
    }

    const send = () =>
      this._post(
        { jsonrpc: "2.0", method, params, id: ++this._id },
        { withSession: true }
      );

    let { res, payload } = await send();

    const authProblem =
      res.status === 401 ||
      res.status === 403 ||
      (payload.error && looksLikeAuthProblem(payload.error));

    if (authProblem && method !== "Auth.login") {
      this.sessionId = null;
      await this._login();
      ({ res, payload } = await send());
    }

    if (payload.error) {
      throw new KiwiError(method, payload.error, params);
    }
    if (!res.ok) {
      throw new Error(`Kiwi HTTP ${res.status} for ${method}`);
    }
    return payload.result;
  }
}
