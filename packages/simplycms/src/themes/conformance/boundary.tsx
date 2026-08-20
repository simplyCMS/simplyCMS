import { Component, type ReactNode } from 'react';

interface BoundaryProps {
  onError: (error: unknown) => void;
  children: ReactNode;
}

interface BoundaryState {
  failed: boolean;
}

/**
 * Межа помилки conformance-рендеру.
 *
 * 🔴 Чому саме межа, а не «спробувати спіймати виняток з `root.render`»:
 * React рендерить конкурентно й помилку компонента синхронно з виклику
 * рендеру НЕ кидає — вона доходить до обробника уже після. Межа перетворює
 * падіння view на ДЕТЕРМІНОВАНИЙ факт: `onError` викликається рівно один
 * раз, і kit має що показати автору теми замість «тест просто зелений».
 */
export class ConformanceBoundary extends Component<
  BoundaryProps,
  BoundaryState
> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
