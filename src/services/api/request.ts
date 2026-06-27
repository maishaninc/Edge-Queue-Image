import axios from "axios";

/** Shared axios instance — same-origin, cookie-based auth, normalized errors. */
export const api = axios.create({ withCredentials: true });

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error?.response?.data;
    const message = (data && (data.error || data.message)) || error?.message || "请求失败";
    return Promise.reject(new Error(message));
  },
);

export default api;
