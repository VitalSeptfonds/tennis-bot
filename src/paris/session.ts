// Session HTTP vers tennis.paris.fr : fetch natif + cookies gérés à la main (pas de dépendance).
export const BASE_URL = "https://tennis.paris.fr/tennis/jsp/site/Portal.jsp";
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) TennisBot/0.1";

export class ParisSession {
  // Cookies par hôte : ceux de tennis.paris.fr ne partent jamais vers auth.paris.fr (et inversement).
  private jars = new Map<string, Map<string, string>>();

  private jar(url: string): Map<string, string> {
    const host = new URL(url).host;
    if (!this.jars.has(host)) this.jars.set(host, new Map());
    return this.jars.get(host)!;
  }

  private cookieHeader(url: string): string {
    return [...this.jar(url)].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private storeCookies(url: string, res: Response): void {
    const jar = this.jar(url);
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  private hasSession(): boolean {
    return this.jar(BASE_URL).has("JSESSIONID");
  }

  /** fetch avec suivi manuel des redirections pour conserver les cookies. */
  async request(url: string, init: RequestInit = {}): Promise<Response> {
    let current = url;
    let method = init.method ?? "GET";
    let body = init.body;
    // L'ouverture de session passe par un aller-retour SSO silencieux (~6 redirections).
    for (let hop = 0; hop < 10; hop++) {
      const res = await fetch(current, {
        ...init,
        method,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(20_000),
        headers: {
          "User-Agent": USER_AGENT,
          ...(this.jar(current).size ? { Cookie: this.cookieHeader(current) } : {}),
          ...init.headers,
        },
      });
      this.storeCookies(current, res);
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, current).toString();
        method = "GET";
        body = undefined;
        continue;
      }
      if (!res.ok) throw new Error(`Paris Tennis a répondu ${res.status} sur ${new URL(url).search}`);
      return res;
    }
    throw new Error("Trop de redirections vers Paris Tennis");
  }

  /** Ouvre la page de recherche pour obtenir un cookie de session. */
  async ensureSession(): Promise<void> {
    if (this.hasSession()) return;
    await this.request(`${BASE_URL}?page=recherche&action=rechercher_creneau`);
  }

  async postForm(query: string, form: URLSearchParams, ajax = false): Promise<string> {
    const res = await this.request(`${BASE_URL}?${query}`, {
      method: "POST",
      body: form.toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        ...(ajax ? { "X-Requested-With": "XMLHttpRequest" } : {}),
      },
    });
    return res.text();
  }
}
