// Auth Event Emitter for handling automatic logout on token expiration
// This allows any service to trigger a logout without needing access to React context

type AuthEventListener = () => void;

class AuthEventEmitter {
  private listeners: AuthEventListener[] = [];

  // Subscribe to logout events
  subscribe(listener: AuthEventListener): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Emit logout event (called when token expires or is invalid)
  emitLogout(): void {
    console.log('🔐 Auth event: Token expired, triggering automatic logout...');
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in auth event listener:', error);
      }
    });
  }
}

// Singleton instance
export const authEvents = new AuthEventEmitter();
