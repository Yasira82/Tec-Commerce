export const TEC_ROUTES = {
  HUB:       'https://tec-app-frontend.vercel.app/hub',
  SETTINGS:  'https://tec-commerce-app.vercel.app/app/settings',
  DASHBOARD: 'https://tec-app-frontend.vercel.app/dashboard',
} as const;

export const goToTEC = (path: keyof typeof TEC_ROUTES): void => {
  window.location.replace(TEC_ROUTES[path]);
};
