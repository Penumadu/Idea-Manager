/**
 * Antigravity Reactive Data Provider
 * A simple proxy-based state management system.
 */
export class ReactiveProvider {
  constructor(initialState = {}) {
    this.listeners = new Set();
    this.state = new Proxy(initialState, {
      set: (target, key, value) => {
        target[key] = value;
        this.notify();
        return true;
      },
      get: (target, key) => {
        return target[key];
      }
    });
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach(callback => callback(this.state));
  }

  setState(newState) {
    Object.assign(this.state, newState);
  }
}

/**
 * Base Component class for Antigravity components (.ag)
 */
export class AgComponent {
  constructor(props = {}) {
    this.props = props;
    this.element = document.createElement('div');
  }

  render() {
    return '';
  }

  update(newProps) {
    this.props = { ...this.props, ...newProps };
    this.element.innerHTML = this.render();
  }

  mount(parent) {
    this.element.innerHTML = this.render();
    parent.appendChild(this.element);
  }
}
