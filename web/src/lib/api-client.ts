import Axios from 'axios';

export const api = Axios.create({
  baseURL: 'http://localhost:4000/api/v1',
});

api.interceptors.response.use(
  response => {
    return response.data;
  }
  // error => {
  //   // const message = error?.response?.error || error?.message;
  //   // show notif

  //   return Promise.reject(error);
  // }
);
