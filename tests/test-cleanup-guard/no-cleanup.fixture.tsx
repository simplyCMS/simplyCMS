// Фікстура негативного контролю гарда (не тест: розширення не `.test.`).
import { render } from '@testing-library/react';

export const noCleanup = () => render(null);
