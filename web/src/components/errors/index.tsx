import { Button } from '../ui/Button';

export const GlobalErrorFallback = () => {
  return (
    <div
      role="alert"
      className="flex h-screen w-screen items-center justify-center flex-col text-error"
    >
      <h2 className="text-lg font-semibold">Ooops, something went wrong 🥲</h2>
      <Button variant='primary' className="mt-4" onClick={() => window.location.assign(window.location.origin)}>
        Refresh
      </Button>
    </div>
  );
};
