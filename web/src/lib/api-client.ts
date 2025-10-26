import Axios from 'axios';
import { toast } from 'sonner';

export const api = Axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL!,
});

api.interceptors.response.use(
  response => {
    return response.data;
  },
  error => {
    const message = error?.message || 'Something went wrong!';
    toast.error(message);

    return Promise.reject(error);
  }
);
