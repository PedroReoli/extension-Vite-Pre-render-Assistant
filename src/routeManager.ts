import { ConfigManager, Route, PrerenderConfig } from './configManager';

/**
 * Gerencia a lista de rotas: listar, adicionar, ativar e desativar.
 * Sempre persiste o estado via ConfigManager.
 */
export class RouteManager {
  constructor(private configManager: ConfigManager) {}

  /**
   * Retorna todas as rotas. Se o arquivo não existir, cria com padrão.
   */
  listRoutes(): Route[] {
    const config = this.configManager.read();
    if (!config) {
      const created = this.configManager.ensureExists();
      return created.routes;
    }
    return config.routes;
  }

  /**
   * Retorna apenas rotas habilitadas.
   */
  listEnabledRoutes(): Route[] {
    return this.listRoutes().filter((r) => r.enabled);
  }

  /**
   * Adiciona uma nova rota. Ignora se já existir uma com o mesmo path.
   */
  addRoute(routePath: string): Route[] {
    const config = this.getOrCreateConfig();
    const normalized = this.normalizePath(routePath);

    const exists = config.routes.some((r) => r.path === normalized);
    if (exists) {
      return config.routes;
    }

    config.routes.push({ path: normalized, enabled: true });
    this.configManager.write(config);
    return config.routes;
  }

  /**
   * Remove uma rota pelo path.
   */
  removeRoute(routePath: string): Route[] {
    const config = this.getOrCreateConfig();
    config.routes = config.routes.filter((r) => r.path !== routePath);
    this.configManager.write(config);
    return config.routes;
  }

  /**
   * Alterna o estado enabled de uma rota.
   */
  toggleRoute(routePath: string): Route[] {
    const config = this.getOrCreateConfig();
    const route = config.routes.find((r) => r.path === routePath);
    if (route) {
      route.enabled = !route.enabled;
      this.configManager.write(config);
    }
    return config.routes;
  }

  private getOrCreateConfig(): PrerenderConfig {
    const config = this.configManager.read();
    if (config) {
      return config;
    }
    return this.configManager.ensureExists();
  }

  private normalizePath(routePath: string): string {
    let p = routePath.trim();
    if (!p.startsWith('/')) {
      p = '/' + p;
    }
    if (p.length > 1 && p.endsWith('/')) {
      p = p.slice(0, -1);
    }
    return p;
  }
}
