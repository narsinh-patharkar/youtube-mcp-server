/**
 * DI Container - Lightweight wrapper around tsyringe
 * Provides type-safe registration and resolution
 */

import {
  Lifecycle,
  container as tsyringeContainer,
  type DependencyContainer,
  type InjectionToken,
} from 'tsyringe';

/**
 * Extended container with type-safe methods
 */
export class TypedContainer {
  private readonly container: DependencyContainer;

  constructor(container: DependencyContainer = tsyringeContainer) {
    this.container = container;
  }

  /**
   * Register a singleton (single instance for entire app lifecycle)
   */
  registerSingleton<T>(
    token: InjectionToken<T>,
    implementation: new (...args: unknown[]) => T
  ): void {
    this.container.register(token, {
      useClass: implementation,
      lifecycle: Lifecycle.Singleton,
    } as any);
  }

  /**
   * Register a transient (new instance each resolution)
   */
  registerTransient<T>(
    token: InjectionToken<T>,
    implementation: new (...args: unknown[]) => T
  ): void {
    this.container.register(token, { useClass: implementation } as any);
  }

  /**
   * Register a scoped instance (single instance per scope)
   */
  registerScoped<T>(token: InjectionToken<T>, implementation: new (...args: unknown[]) => T): void {
    this.container.register(token, {
      useClass: implementation,
      lifecycle: Lifecycle.ContainerScoped,
    } as any);
  }

  /**
   * Register a factory function
   */
  registerFactory<T>(token: InjectionToken<T>, factory: (c: DependencyContainer) => T): void {
    this.container.register(token, { useFactory: factory } as any);
  }

  /**
   * Register a pre-created instance
   */
  registerInstance<T>(token: InjectionToken<T>, instance: T): void {
    this.container.registerInstance(token, instance);
  }

  /**
   * Register a value (alias for registerInstance)
   */
  registerValue<T>(token: InjectionToken<T>, value: T): void {
    this.container.register(token, { useValue: value } as any);
  }

  /**
   * Resolve a dependency
   */
  resolve<T>(token: InjectionToken<T>): T {
    return this.container.resolve(token);
  }

  /**
   * Try to resolve a dependency (returns undefined if not registered)
   */
  tryResolve<T>(token: InjectionToken<T>): T | undefined {
    try {
      return this.container.resolve(token);
    } catch {
      return undefined;
    }
  }

  /**
   * Check if a token is registered
   */
  isRegistered<T>(token: InjectionToken<T>): boolean {
    return this.container.isRegistered(token);
  }

  /**
   * Create a child container (for request scoping)
   */
  createChild(): TypedContainer {
    return new TypedContainer(this.container.createChildContainer());
  }

  /**
   * Clear all registrations (mainly for testing)
   */
  clear(): void {
    this.container.clearInstances();
  }

  /**
   * Get the underlying tsyringe container
   */
  getRaw(): DependencyContainer {
    return this.container;
  }
}

/**
 * Global container instance
 */
export const diContainer = new TypedContainer();

/**
 * Type-safe resolution helper
 */
export function inject<T>(token: InjectionToken<T>): T {
  return diContainer.resolve(token);
}

/**
 * Type-safe registration helpers
 */
export function provideSingleton<T>(
  token: InjectionToken<T>,
  implementation: new (...args: unknown[]) => T
): void {
  diContainer.registerSingleton(token, implementation);
}

export function provideTransient<T>(
  token: InjectionToken<T>,
  implementation: new (...args: unknown[]) => T
): void {
  diContainer.registerTransient(token, implementation);
}

export function provideFactory<T>(
  token: InjectionToken<T>,
  factory: (c: TypedContainer) => T
): void {
  // Wrap the factory to convert TypedContainer to DependencyContainer
  diContainer.registerFactory(token, (c: DependencyContainer) => {
    const typedContainer = new TypedContainer(c);
    return factory(typedContainer);
  });
}

export function provideValue<T>(token: InjectionToken<T>, value: T): void {
  diContainer.registerValue(token, value);
}

/**
 * Reset container (for testing)
 */
export function resetContainer(): void {
  diContainer.clear();
}

/**
 * Registration function type for modules
 */
export type ModuleRegistration = (container: TypedContainer) => void | Promise<void>;

/**
 * Compose multiple module registrations
 */
export async function composeModules(...modules: ModuleRegistration[]): Promise<void> {
  for (const module of modules) {
    await module(diContainer);
  }
}
