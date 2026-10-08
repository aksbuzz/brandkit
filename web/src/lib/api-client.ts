import Axios from 'axios';
import { toast } from 'sonner';

// WARNING: anything in VITE_* is compiled into the public JavaScript bundle. Setting VITE_API_KEY is
// acceptable only for an internal deployment; for a public app, authenticate users instead (see ADR 0010).
const apiKey = import.meta.env.VITE_API_KEY as string | undefined;

export const api = Axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL!,
  headers: apiKey ? { 'X-Api-Key': apiKey } : undefined,
});

api.interceptors.response.use(
  response => {
    return response.data;
  },
  error => {
    const message = error?.response?.data?.message || error?.message || 'Something went wrong!';
    toast.error(message);

    return Promise.reject(error);
  }
);
